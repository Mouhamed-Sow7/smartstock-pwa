import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
export const jwtInterceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn,
): Observable<HttpEvent<any>> => {
  const router = inject(Router);
  // Clé alignée avec AuthService ('ss_token')
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('ss_token') : null;
  let authReq = req;
  if (token) {
    authReq = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // Rediriger vers /login uniquement si on n'est PAS déjà sur /login
      // et que le token n'existe pas (vraie session expirée, pas une race condition)
      if (error.status === 401 && !router.url.startsWith('/login')) {
        const hasToken = typeof localStorage !== 'undefined' && !!localStorage.getItem('ss_token');
        if (!hasToken) {
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    }),
  );
};
