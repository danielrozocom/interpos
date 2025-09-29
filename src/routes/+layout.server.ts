import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
  const session = typeof (event.locals as any).getSession === 'function' ? await (event.locals as any).getSession() : null;
  return { session };
};
