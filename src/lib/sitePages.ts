/** Known internal pages on the public site, for the link picker — see
 *  ncuboltnut.github.io/src/pages for the authoritative route list. Update
 *  this alongside any new top-level page added there. */
export interface SitePage {
  href: string;
  label: string;
}

export const sitePages: SitePage[] = [
  { href: '/', label: '首頁' },
  { href: '/news', label: '最新動態' },
  { href: '/about', label: '關於我們' },
  { href: '/activities', label: '活動花絮' },
  { href: '/achievements', label: '競賽成就' },
  { href: '/sponsors', label: '贊助商' },
  { href: '/contact', label: '聯絡我們' },
];
