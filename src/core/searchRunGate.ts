export class SearchRunGate {
  private token = 0;

  next() {
    this.token += 1;
    return this.token;
  }

  cancel() {
    this.token += 1;
  }

  isCurrent(token: number) {
    return token === this.token;
  }
}
