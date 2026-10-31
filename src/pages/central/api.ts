import { fetchApi } from '@/utils/fetch';

export const getEscadaData = async () => {
  return fetchApi('/escada');
};
