import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: 'website' | 'article';
}

export function SEO({ 
  title, 
  description, 
  path, 
  image = 'https://storage.googleapis.com/gpt-engineer-file-uploads/6KqQuPTsG5UR3rnYRHZxmwbxZsa2/social-images/social-1767403202207-im.jpg',
  type = 'website' 
}: SEOProps) {
  const siteUrl = 'https://algoarena-9nwy.onrender.com';
  const fullUrl = `${siteUrl}${path}`;
  const fullTitle = `JC AlgoArena – ${title}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="author" content="JC AlgoArena" />
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image.startsWith('http') ? image : `${siteUrl}${image}`} />
      <meta property="og:site_name" content="JC AlgoArena" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@jc_coder_" />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image.startsWith('http') ? image : `${siteUrl}${image}`} />
      
      {/* Canonical */}
      <link rel="canonical" href={fullUrl} />
    </Helmet>
  );
}
