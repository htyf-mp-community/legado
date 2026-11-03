/** The independent debug shell does not include the host's Nitro Fetch module. */
export function fetch(): never {
  throw new Error('此书源需要在 HTYF 宿主中使用手动重定向请求');
}
