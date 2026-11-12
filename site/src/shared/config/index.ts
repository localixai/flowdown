// The site's content, typed: what content/ says, for every layer to read.
import docs from '@content/docs/nav';
import landing from '@content/landing';
import site from '@content/site';

export type { Block, Cell, Line, Tone } from '@/shared/ui';
export type { Card, DocsConfig, LandingContent, Media, NavLink, SiteConfig } from './types';
export { DOC_TITLES, RELEASES } from 'virtual:site-data';

export const SITE = site;
export const LANDING = landing;
export const DOCS_NAV = docs;
/** Where the docs live on the site. */
export const DOCS = '/docs';
