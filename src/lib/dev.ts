import { dev, browser } from '$app/environment';
import { PUBLIC_DEV_AUTOLOGIN } from '$env/static/public';

export const AUTOLOGIN = dev && PUBLIC_DEV_AUTOLOGIN && browser;