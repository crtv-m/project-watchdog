import type { CheckType } from '@prisma/client';

export type CheckInput = {
  type: CheckType;
  expectedValue: string;
  httpStatus: number | null;
  responseTime: number;
  body: string;
};

export function evaluateCheck(input: CheckInput): boolean {
  switch (input.type) {
    case 'STATUS_CODE':
      return input.httpStatus === Number(input.expectedValue);
    case 'RESPONSE_TIME':
      return input.responseTime <= Number(input.expectedValue);
    case 'BODY_CONTAINS':
      return input.body.includes(input.expectedValue);
    case 'BODY_NOT_CONTAINS':
      return !input.body.includes(input.expectedValue);
  }
}
