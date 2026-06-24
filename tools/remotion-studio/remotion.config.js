import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// public/ — сюда кладём локальные клипы/аудио; в props ссылаемся относительным путём.
Config.setPublicDir('public');
