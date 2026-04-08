import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

// Note: JwtInterceptor est maintenant configuré dans app.config.ts via withInterceptors

@NgModule({
  imports: [CommonModule, HttpClientModule],
})
export class CoreModule {}
