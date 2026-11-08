/**
 * What the Instances view may show (BUG-000049-UhmQ897l): only what the person logged in to catalyst-users can
 * see. With no one logged in — or before catalyst-users has answered — it shows nothing: no deployment, no
 * folder offered a set-up, no search result, no document.
 */

/**
 * The view's top-level entries: all of them while someone is logged in, none otherwise.
 *
 * @param loggedIn whether catalyst-users answered that someone is logged in.
 * @param entries the entries the view would show: deployments, then folders offered a set-up.
 */
export function visibleRoot<T>(loggedIn: boolean, entries: readonly T[]): T[] {
  return loggedIn ? [...entries] : [];
}
