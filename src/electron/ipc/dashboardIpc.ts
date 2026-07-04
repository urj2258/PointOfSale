import { ipcMain } from 'electron';
import * as dashboardRepo from '../repositories/dashboardRepository.js';

export function registerDashboardIpc() {
  ipcMain.handle('dashboard:stats', () => {
    return dashboardRepo.getDashboardStats();
  });
}
