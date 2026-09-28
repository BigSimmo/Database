export type RequestSent = (message: string, undo?: () => Promise<void>) => void;
