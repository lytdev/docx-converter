/** Browser build alias: never bundle native Node bindings in a page or Worker. */
export function createCanvas(): never {
  throw new Error('This browser does not provide a Canvas implementation');
}
