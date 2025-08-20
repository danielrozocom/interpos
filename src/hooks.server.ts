import type { HandleError } from '@sveltejs/kit';

export const handleError: HandleError = async ({ error, event }) => {
  console.error('Error occurred:', error, 'on', event.url.pathname);
  
  return {
    message: error?.message || 'Ha ocurrido un error inesperado'
  };
};
