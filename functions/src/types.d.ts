declare namespace functions.https {
  interface CallableContext {
    auth?: {
      uid: string;
      token: DecodedIdToken;
    };
    rawRequest: Request;
  }
}

interface DecodedIdToken {
  aud: string;
  auth_time: number;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  [key: string]: string | number | boolean;
}

interface Request {
  url: string;
  method: string;
  headers: Record<string, string>;
  rawBody: Buffer;
  body: unknown;
}

export interface SearchFilters {
    genre?: string;
    mood?: string;
    language?: string;
}

export interface SearchSuggestion {
    text: string;
    type: "genre" | "mood" | "language" | "query";
    count: number;
}

export interface SearchError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
} 