import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
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

  ipcMain.handle('day-closing:get-export-dir', () => {
    return dayClosingRepo.getExportDir();
  });

  ipcMain.handle('day-closing:choose-export-dir', async () => {
    const win = BrowserWindow.fromWebContents(arguments[0] as any) || BrowserWindow.getAllWindows()[0];
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: 'Choose Export Directory',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (canceled || filePaths.length === 0) return { canceled: true };
    dayClosingRepo.setExportDir(filePaths[0]);
    return { success: true, path: filePaths[0] };
  });

  ipcMain.handle('day-closing:export-excel', async (_e, businessDate: string) => {
    assertNonEmptyString(businessDate, 'business_date');

    let exportDir = dayClosingRepo.getExportDir();
    if (!exportDir) {
      const win = BrowserWindow.fromWebContents(_e.sender) || BrowserWindow.getAllWindows()[0];
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Choose Directory for Day Closing Report',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (canceled || filePaths.length === 0) return { success: false, canceled: true };
      exportDir = filePaths[0];
      dayClosingRepo.setExportDir(exportDir);
    }

    const { buffer, filePath } = await dayClosingRepo.exportDayClosingExcel(businessDate);
    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  });
}
