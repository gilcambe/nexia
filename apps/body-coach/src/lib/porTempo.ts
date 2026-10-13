// Exercícios medidos em segundos, sem carga nem repetições (prancha, isometria).
export const ehPorTempo = (ex: string) => /prancha|isom[eé]tric|wall sit|cadeirinha|hollow/i.test(ex);
