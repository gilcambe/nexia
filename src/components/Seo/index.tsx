import React from 'react';
import Head from 'react-helmet';

interface SeoProps {
  title: string;
  description: string;
  url?: string;
  type?: string;
}

const Seo: React.FC<SeoProps> = ({ 
  title, 
  description, 
  url = 'https://nome.pages.dev', 
  type = 'website' 
}) => {
  const fullTitle = `${title} | NEXIA`;
  
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Head>
  );
};

export default Seo;