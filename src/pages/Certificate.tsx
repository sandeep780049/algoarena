import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { CertificateCard } from '@/components/certificate/CertificateCard';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface CertificateData {
  id: string;
  username: string;
  contest_name: string;
  contest_date: string;
  rank: number;
  certificate_code: string;
  issued_at: string;
}

export default function Certificate() {
  const { code } = useParams<{ code: string }>();
  const [certificate, setCertificate] = useState<CertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (code) {
      fetchCertificate();
    }
  }, [code]);

  const fetchCertificate = async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_certificate_by_code', {
        p_code: code
      });

      if (rpcError) throw rpcError;

      if (!data) {
        setError('Certificate not found');
        return;
      }

      setCertificate(data as unknown as CertificateData);
    } catch (err) {
      console.error('Error fetching certificate:', err);
      setError('Failed to load certificate');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="h-8 w-48 bg-secondary rounded" />
              <div className="h-96 bg-secondary rounded-xl" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !certificate) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto text-center">
            <AlertCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Certificate Not Found</h1>
            <p className="text-muted-foreground mb-6">
              {error || 'This certificate does not exist or has been removed.'}
            </p>
            <Link to="/">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Home
              </Button>
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
          
          <h1 className="text-2xl font-bold mb-6">Certificate of Achievement</h1>
          
          <CertificateCard
            username={certificate.username}
            contestName={certificate.contest_name}
            contestDate={certificate.contest_date}
            rank={certificate.rank}
            certificateCode={certificate.certificate_code}
            issuedAt={certificate.issued_at}
          />
        </div>
      </div>
    </Layout>
  );
}
