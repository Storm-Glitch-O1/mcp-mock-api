export interface MockEndpoint {
  method: string;
  path: string;
  response: any;
  statusCode: number;
}

export type MockStorage = Record<string, MockEndpoint>;
