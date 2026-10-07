import { HttpResponse } from '@angular/common/http';

export interface CachedResponse {
  readonly response: HttpResponse<unknown>;
  readonly expiresAt: number;
}
