import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getFirebase } from '@/lib/firebaseClient';


type Mode = 'login' | 'signup';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const handleForgot = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) {
      setError('Informe seu e-mail para recuperar a senha.');
      return;
    }
    setSubmitting(true);
    try {
      const handles = await getFirebase();
      if (!handles) {
        setError('Serviço de autenticação indisponível no momento.');
        return;
      }
      await sendPasswordResetEmail(handles.auth, email.trim());
      setInfo('Enviamos um link de redefinição para o seu e-mail.');
    } catch (err: any) {
      if (err?.code && (err.code.includes('user-not-found') || err.code.includes('invalid-email'))) {
        setError('Confira o e-mail digitado.');
      } else if (err?.code && err.code.includes('too-many-requests')) {
        setError('Muitas tentativas. Tente de novo em alguns minutos.');
      } else {
        setError('Não foi possível enviar o e-mail de redefinição.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha para continuar.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      setError('Diga seu nome para criarmos sua conta.');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) {
          setError(err);
        } else {
          navigate('/', { replace: true });
        }
      } else {
        const { error: err, needsEmailConfirm } = await signUp(
          email.trim(),
          password,
          name.trim(),
        );
        if (err) {
          setError(err);
        } else if (needsEmailConfirm) {
          setInfo(
            'Conta criada! Enviamos um link de confirmação para o seu e-mail. Confirme para começar.',
          );
        } else {
          navigate('/onboarding', { replace: true });
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background-50 px-4 py-10">
      <div className="w-full max-w-md">
        {/* brand */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-500 text-background-50">
            <i className="ri-heart-3-line text-2xl"></i>
          </div>
          <p className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground-950">
            NEXIA
          </p>
          <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.18em] text-foreground-400">
            Body Coach AI
          </p>
        </div>

        <div className="rounded-2xl border border-background-200 bg-background-50 p-4 sm:p-6">
          {/* segmented control */}
          <div className="flex rounded-full bg-background-100 p-1">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-background-50 text-foreground-950'
                  : 'text-foreground-500 hover:text-foreground-700'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => switchMode('signup')}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition ${
                mode === 'signup'
                  ? 'bg-background-50 text-foreground-950'
                  : 'text-foreground-500 hover:text-foreground-700'
              }`}
            >
              Criar conta
            </button>
          </div>

          <h1 className="mt-6 font-heading text-xl font-bold text-foreground-950">
            {mode === 'login' ? 'Bem-vindo de volta' : 'Comece sua jornada'}
          </h1>
          <p className="mt-1 text-sm text-foreground-600">
            {mode === 'login'
              ? 'Entre para acessar seus treinos, evolução e dados.'
              : 'Crie sua conta e tenha seus próprios dados de evolução.'}
          </p>

          

          

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground-600">Nome completo</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Rafael Moreira"
                  autoComplete="name"
                  className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground-600">E-mail ou usuário</span>
              <input
                type="text"
                inputMode="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@exemplo.com"
                autoComplete="username"
                className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground-600">Senha</span>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleForgot}
                    className="text-xs text-primary-600 hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm outline-none focus:border-primary-300"
              />
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-primary-100/70 px-3 py-2.5 text-sm text-primary-800">
                <i className="ri-error-warning-line mt-0.5"></i>
                <span>{error}</span>
              </div>
            )}

            {info && (
              <div className="flex items-start gap-2 rounded-lg bg-accent-100/70 px-3 py-2.5 text-sm text-accent-800">
                <i className="ri-checkbox-circle-line mt-0.5"></i>
                <span>{info}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary-500 px-4 py-3 text-sm font-semibold text-background-50 transition hover:bg-primary-600 disabled:opacity-60"
            >
              {submitting && <i className="ri-loader-4-line animate-spin"></i>}
              {submitting
                ? 'Aguarde...'
                : mode === 'login'
                  ? 'Entrar'
                  : 'Criar conta'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-foreground-400">
          Ao continuar, você concorda com nossos{' '}
          <Link to="/termos" className="underline">termos de uso</Link>
          {' '}e{' '}
          <Link to="/privacidade" className="underline">política de privacidade</Link>
          .
        </p>

        <p className="mt-4 text-center">
          <Link to="/" className="text-sm text-foreground-500 hover:text-foreground-700">
            ← Voltar ao início
          </Link>
        </p>
      </div>
    </div>
  );
}