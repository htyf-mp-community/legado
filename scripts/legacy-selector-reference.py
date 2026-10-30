"""Regenerate index fixtures by compiling the source's unchanged Kotlin class.

This is a JVM reference harness, not an Android build. Supply a local Kotlin
compiler lib directory and the source-pinned Jsoup 1.16.2 jar. No target runtime
dependencies are installed or changed.
"""

import argparse
import hashlib
import json
import pathlib
import subprocess
import tempfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-root", type=pathlib.Path, required=True)
    parser.add_argument("--kotlin-lib", type=pathlib.Path, required=True)
    parser.add_argument("--jsoup-jar", type=pathlib.Path, required=True)
    parser.add_argument("--output", type=pathlib.Path, required=True)
    args = parser.parse_args()
    source_path = args.source_root / "app/src/main/java/io/legado/app/model/analyzeRule/AnalyzeByJSoup.kt"
    source = source_path.read_text()
    start = source.index('    @Suppress("UNCHECKED_CAST")\n    data class ElementsSingle(')
    end = source.index("\n\n    internal inner class SourceRule", start)
    extracted = source[start:end]
    stdlib = next(args.kotlin_lib.glob("kotlin-stdlib-[0-9]*.jar"))
    classpath = f"{stdlib}:{args.jsoup_jar.resolve()}"
    wrapper = """import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.select.Collector
import org.jsoup.select.Elements
import org.jsoup.select.Evaluator
class Reference {
    companion object { private val nullSet = setOf(null) }
"""
    runner = r"""
}
fun main(args: Array<String>) {
  java.io.File(args[0]).forEachLine { line ->
    val parts = line.split("\t", limit = 2)
    val count = parts[0].toInt()
    val html = "<section>" + (0 until count).joinToString("") { "<i>$it</i>" } + "</section>"
    try {
      val result = Reference.ElementsSingle().getElementsSingle(Jsoup.parse(html).selectFirst("section")!!, parts[1])
      println(line + "\t" + result.joinToString(",") { it.text() })
    } catch (e: Exception) { println(line + "\tERROR:" + e.javaClass.simpleName) }
  }
}
"""
    bounds = ["", "-12", "-1", "0", "1", "3", "8"]
    steps = ["-12", "-2", "0", "1", "2", "12"]
    rules = [f"tag.i[{start}:{end}:{step}]" for start in bounds for end in bounds for step in steps]
    rules += [f"tag.i[!{start}:{end}:{step}]" for start in bounds for end in bounds for step in steps]
    rules += [
        "tag.i", "tag.i.4:1:-1:1", "tag.i!0:2:-1", "tag.i.!0:2:-1",
        "tag.i. 4 : 1 : - 1 : 1", "tag.i[4,1:3,1,-1]", "tag.i[!1:3,-1]",
        "tag.i[ ! 1 : 3, -1 ]", "tag.i[ 4, 1 : 3 : 2, -1 ]",
        "tag.i[99,-99,2,2]", "tag.i[-1:0]", "tag.i[0:1]", "tag.i[:2]",
        "tag.i[3:]", "tag.i[:]", "tag.i[!0]", "tag.i[!99]", "tag.i[2:5:99]",
        "tag.i.2147483647", "tag.i.-2147483647", "tag.i.2147483648",
        "tag.i.-2147483648", "tag.i[2147483648]", "tag.i[0:2147483648]",
        "tag.i[0:2:2147483648]", "tag.i[0:2:-2147483648]",
    ]
    cases = [(count, rule) for count in [0, 1, 2, 6] for rule in rules]
    with tempfile.TemporaryDirectory(prefix="legado-selector-reference-") as folder:
        folder = pathlib.Path(folder)
        kotlin = folder / "Reference.kt"
        kotlin.write_text(wrapper + extracted + runner)
        inputs = folder / "cases.tsv"
        inputs.write_text("".join(f"{count}\t{rule}\n" for count, rule in cases))
        jar = folder / "reference.jar"
        subprocess.run([
            "java", "-cp", f"{args.kotlin_lib.resolve()}/*",
            "org.jetbrains.kotlin.cli.jvm.K2JVMCompiler", "-no-stdlib", "-no-reflect",
            "-classpath", classpath, "-d", str(jar), str(kotlin),
        ], check=True, capture_output=True, text=True)
        result = subprocess.run([
            "java", "-cp", f"{jar}:{classpath}", "ReferenceKt", str(inputs),
        ], check=True, capture_output=True, text=True)
    rows = []
    for line in result.stdout.splitlines():
        count, rule, output = line.split("\t", 2)
        row = {"count": int(count), "rule": rule}
        if output.startswith("ERROR:"):
            row["error"] = output.removeprefix("ERROR:")
        else:
            row["values"] = output.split(",") if output else []
        rows.append(row)
    assert len(rows) == len(cases)
    fixture = {
        "sourcePath": str(source_path.relative_to(args.source_root)),
        "sourceSha256": digest(source.encode()),
        "extractedClassSha256": digest(extracted.encode()),
        "jsoupVersion": "1.16.2",
        "jsoupJarSha256": digest(args.jsoup_jar.read_bytes()),
        "caseCount": len(rows),
        "cases": rows,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(fixture, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(json.dumps({"cases": len(rows), "nativeErrors": sum("error" in row for row in rows), "sourceSha256": fixture["sourceSha256"]}))


if __name__ == "__main__":
    main()
