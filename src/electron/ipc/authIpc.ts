import { ipcMain } from 'electron';
import * as authRepo from '../repositories/authRepository.js';
import { assertNonEmptyString, assertEmail } from '../validation.js';

export function registerAuthIpc() {
  ipcMain.handle('auth:login', (_e, email: string, password: string) => {
    assertEmail(email, 'email');
    assertNonEmptyString(password, 'password');
    return authRepo.loginUser(email, password);
  });

  ipcMain.handle('auth:register', (_e, fullName: string, email: string, username: string, password: string) => {
    assertNonEmptyString(fullName, 'full_name');
    assertEmail(email, 'email');
    assertNonEmptyString(username, 'username');
    assertNonEmptyString(password, 'password');
    return authRepo.registerOwner(fullName, email, username, password);
  });

  ipcMain.handle('auth:owner-status', () => {
    return authRepo.getOwnerStatus();
  });
}
