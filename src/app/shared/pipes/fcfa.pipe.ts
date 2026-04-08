import { Pipe, PipeTransform } from '@angular/core';
@Pipe({ name: 'fcfa', standalone: true })
export class FcfaPipe implements PipeTransform {
  transform(value: number): string {
    if (value === null || value === undefined) {
      return '0 FCFA';
    }
    const formatted = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return `${formatted} FCFA`;
  }
}
