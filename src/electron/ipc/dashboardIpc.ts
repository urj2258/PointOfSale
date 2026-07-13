import { ipcMain } from 'electron';
import * as dashboardRepo from '../repositories/dashboardRepository.js';
import type { DashboardPeriod } from '../repositories/dashboardRepository.js';

export function registerDashboardIpc() {
  ipcMain.handle(
    'dashboard:stats',
    (_e, threshold?: number, period?: DashboardPeriod, startDate?: string, endDate?: string) => {
      return dashboardRepo.getDashboardStats(threshold, period, startDate, endDate);
    }
  );
}
