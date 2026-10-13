// NestJS 예외의 최소 대체 — 이식된 서비스 코드가 그대로 쓴다.
// 라우트 핸들러(wrapHandler)가 status 를 읽어 HTTP 응답으로 바꾼다.
export class HttpException extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(404, message);
  }
}

export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super(400, message);
  }
}

export class ConflictException extends HttpException {
  constructor(message = 'Conflict') {
    super(409, message);
  }
}

export class Logger {
  constructor(private readonly name: string) {}
  log(msg: unknown) {
    console.log(`[${this.name}]`, msg);
  }
  warn(msg: unknown) {
    console.warn(`[${this.name}]`, msg);
  }
  error(msg: unknown) {
    console.error(`[${this.name}]`, msg);
  }
}
