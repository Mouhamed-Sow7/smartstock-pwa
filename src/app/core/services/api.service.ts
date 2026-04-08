import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiUrl.replace(/\/+$/, '');

  constructor(private http: HttpClient) {}

  private buildUrl(path: string): string {
    const endpoint = (path || '').replace(/^\/+/, '');
    const url = `${this.base}/${endpoint}`;
    console.log('API CALL:', url);
    return url;
  }

  get(path: string) {
    return this.http.get(this.buildUrl(path));
  }
  post(path: string, body: any) {
    return this.http.post(this.buildUrl(path), body);
  }
  put(path: string, body: any) {
    return this.http.put(this.buildUrl(path), body);
  }
  delete(path: string) {
    return this.http.delete(this.buildUrl(path));
  }
  getBlob(path: string) {
    return this.http.get(this.buildUrl(path), { responseType: 'blob' });
  }
}
