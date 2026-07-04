import { ipcMain } from 'electron';
import * as dayClosingRepo from '../repositories/dayClosingRepository.js';
import { assertNonEmptyString, assertValidDateString } from '../validation.js';

export function registerDayClosingIpc() {
  ipcMain.handle('day-closing:list', (_e, page?: number, limit?: number) => {
    return dayClosingRepo.getDayClosings(page, limit);
  });

  ipcMain.handle('day-closing:get', (_e, date: string) => {
    assertValidDateString(date, 'date');
    return dayClosingRepo.getDayClosingByDate(date);
  });

  ipcMain.handle('day-closing:generate', (_e, businessDate: string) => {
    assertNonEmptyString(businessDate, 'business_date');
    return dayClosingRepo.generateDayClosing(businessDate);
  });
}
