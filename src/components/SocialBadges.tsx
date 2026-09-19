import React from 'react';
import { Globe, ExternalLink } from 'lucide-react';

interface SocialBadgesProps {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  website?: string;
  socialLinks?: string;
  size?: 'sm' | 'md';
}

// Clean URL normalizer
export function formatSocialUrl(type: 'instagram' | 'facebook' | 'linkedin' | 'website', val?: string): string {
  if (!val) return '';
  const clean = val.trim();
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;

  const handle = clean.replace(/^@/, '');
  if (type === 'instagram') return `https://instagram.com/${handle}`;
  if (type === 'facebook') return `https://facebook.com/${handle}`;
  if (type === 'linkedin') {
    if (handle.includes('/')) return `https://linkedin.com/${handle}`;
    return `https://linkedin.com/in/${handle}`;
  }
  return `https://${clean}`;
}

export function formatHandle(val?: string): string {
  if (!val) return '';
  let clean = val.trim();
  clean = clean.replace(/^https?:\/\/(www\.)?/, '');
  clean = clean.replace(/^(instagram\.com|facebook\.com|linkedin\.com\/in|linkedin\.com)\//, '');
  clean = clean.replace(/\/$/, '');
  return clean.length > 20 ? clean.substring(0, 18) + '…' : clean;
}

export function SocialBadges({
  instagram,
  facebook,
  linkedin,
  website,
  socialLinks,
  size = 'sm'
}: SocialBadgesProps) {
  const hasAny = instagram || facebook || linkedin || website || socialLinks;
  if (!hasAny) return null;

  const badgeClass = size === 'sm' 
    ? 'px-2 py-0.5 text-[10px] gap-1 rounded-md' 
    : 'px-2.5 py-1 text-xs gap-1.5 rounded-lg';

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Instagram Badge */}
      {instagram && (
        <a
          href={formatSocialUrl('instagram', instagram)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Instagram: ${instagram}`}
          className={`inline-flex items-center font-semibold bg-gradient-to-r from-[#833AB4]/25 via-[#FD1D1D]/25 to-[#FCAF45]/25 hover:from-[#833AB4]/40 hover:to-[#FCAF45]/40 text-pink-300 border border-pink-500/40 hover:border-pink-400 transition-all ${badgeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Instagram SVG Icon */}
          <svg className="w-3 h-3 flex-shrink-0 fill-current text-pink-400" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
          <span className="truncate">IG: {formatHandle(instagram)}</span>
        </a>
      )}

      {/* Facebook Badge */}
      {facebook && (
        <a
          href={formatSocialUrl('facebook', facebook)}
          target="_blank"
          rel="noopener noreferrer"
          title={`Facebook: ${facebook}`}
          className={`inline-flex items-center font-semibold bg-[#1877F2]/20 hover:bg-[#1877F2]/35 text-blue-300 border border-[#1877F2]/40 hover:border-[#1877F2] transition-all ${badgeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Facebook SVG Icon */}
          <svg className="w-3 h-3 flex-shrink-0 fill-[#1877F2]" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          <span className="truncate">FB: {formatHandle(facebook)}</span>
        </a>
      )}

      {/* LinkedIn Badge */}
      {linkedin && (
        <a
          href={formatSocialUrl('linkedin', linkedin)}
          target="_blank"
          rel="noopener noreferrer"
          title={`LinkedIn: ${linkedin}`}
          className={`inline-flex items-center font-semibold bg-[#0A66C2]/20 hover:bg-[#0A66C2]/35 text-cyan-200 border border-[#0A66C2]/40 hover:border-[#0A66C2] transition-all ${badgeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* LinkedIn SVG Icon */}
          <svg className="w-3 h-3 flex-shrink-0 fill-[#0A66C2]" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
          <span className="truncate">LinkedIn</span>
        </a>
      )}

      {/* General Social Links */}
      {socialLinks && !instagram && !facebook && !linkedin && (
        <a
          href={socialLinks.startsWith('http') ? socialLinks : `https://${socialLinks}`}
          target="_blank"
          rel="noopener noreferrer"
          title={socialLinks}
          className={`inline-flex items-center font-medium bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 border border-purple-500/30 transition-all ${badgeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span className="truncate max-w-[120px]">{formatHandle(socialLinks)}</span>
        </a>
      )}

      {/* Website Badge if needed */}
      {website && (
        <a
          href={website.startsWith('http') ? website : `https://${website}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Website: ${website}`}
          className={`inline-flex items-center font-medium bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 transition-all ${badgeClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Globe className="w-3 h-3 flex-shrink-0" />
          <span className="truncate max-w-[110px]">{formatHandle(website)}</span>
        </a>
      )}
    </div>
  );
}
