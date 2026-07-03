declare module "potrace" {
  export class Potrace {
    setParameters(params: {
      turnPolicy?: string;
      turdSize?: number;
      alphaMax?: number;
      optCurve?: boolean;
      optTolerance?: number;
      threshold?: number;
      blackOnWhite?: boolean;
      color?: string;
      background?: string;
    }): void;
    loadImage(
      target: string | Buffer,
      callback: (err: Error | null) => void
    ): void;
    getPathTag(): string;
    getSVG(): string;
  }
  export function trace(
    target: string | Buffer,
    params: object,
    callback: (err: Error | null, svg: string) => void
  ): void;
}
