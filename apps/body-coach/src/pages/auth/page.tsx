import { useState, type FormEvent } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/components/feature/AuthContext';
import { sendPasswordResetEmail } from 'firebase/auth';
import { getFirebase } from '@/lib/firebaseClient';
import { guardarCodigoDigitado } from '@/lib/acesso';


type Mode = 'login' | 'signup';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, signInGoogle } = useAuth();
  const location = useLocation();
  // Volta para onde a pessoa estava (ex.: a loja de um coach) depois de entrar.
  const voltar = (location.state as { from?: string } | null)?.from;
  // Vindo da página Conheça ("Sou aluno" / "Sou personal"): já abre na aba Criar conta.
  const params = new URLSearchParams(location.search);
  const ehPersonal = params.get('papel') === 'coach';
  const destino = voltar && voltar.startsWith('/') && voltar !== '/auth' ? voltar : null;

  const [mode, setMode] = useState<Mode>(() => (ehPersonal || params.get('modo') === 'criar' ? 'signup' : 'login'));
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // "Tenho um convite": o mesmo código do link (cupom, dias grátis ou código do coach) digitado à mão.
  const [convite, setConvite] = useState(() => { try { return localStorage.getItem('bc_cupom') ?? ''; } catch { return ''; } });
  const [abrirConvite, setAbrirConvite] = useState(() => !!convite);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [google, setGoogle] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setInfo(null);
    setGoogle(true);
    if (mode === 'signup') guardarCodigoDigitado(convite);
    try {
      const r = await signInGoogle();
      if (r.error) setError(r.error);
      else if (r.novo) navigate(destino?.startsWith('/loja/') ? destino : '/onboarding', { replace: true });
      else if (r.novo === false) navigate(destino ?? '/', { replace: true });
    } finally {
      setGoogle(false);
    }
  };

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
    if (mode === 'signup') guardarCodigoDigitado(convite);
    try {
      if (mode === 'login') {
        const { error: err } = await signIn(email.trim(), password);
        if (err) {
          setError(err);
        } else {
          navigate(destino ?? '/', { replace: true });
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
          navigate(destino?.startsWith('/loja/') ? destino : '/onboarding', { replace: true });
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
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="Body Coach" className="h-14 w-14 rounded-2xl" />
          <p className="mt-3 font-heading text-2xl font-bold tracking-tight text-foreground-950">
            Body Coach
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
            {mode === 'login' ? 'Bem-vindo de volta' : ehPersonal ? 'Sua conta de personal' : 'Comece sua jornada'}
          </h1>
          <p className="mt-1 text-sm text-foreground-600">
            {mode === 'login'
              ? 'Entre para acessar seus treinos, evolução e dados.'
              : ehPersonal
                ? 'Crie sua conta e monte fichas e dietas para seus alunos. 3 alunos grátis para sempre.'
                : 'Crie sua conta e tenha seus próprios dados de evolução.'}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={google || submitting}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-800 shadow-sm transition hover:bg-stone-50 disabled:opacity-60"
          >
            {google ? (
              <i className="ri-loader-4-line animate-spin text-lg"></i>
            ) : (
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
                <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
                <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
                <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
              </svg>
            )}
            Entrar com Google
          </button>

          <div className="mt-5 flex items-center gap-3 text-xs text-foreground-400">
            <span className="h-px flex-1 bg-background-200" />
            ou com e-mail
            <span className="h-px flex-1 bg-background-200" />
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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

            {mode === 'signup' && (abrirConvite ? (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground-600">Código do convite (opcional)</span>
                <input
                  type="text"
                  value={convite}
                  onChange={(e) => setConvite(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20))}
                  placeholder="Ex.: CV7K2MQP"
                  aria-label="Código do convite"
                  autoCapitalize="characters"
                  className="rounded-lg border border-background-200 bg-background-50 px-3 py-2.5 text-sm uppercase outline-none focus:border-primary-300"
                />
              </label>
            ) : (
              <button type="button" onClick={() => setAbrirConvite(true)} className="text-sm font-semibold text-primary-600">
                <i className="ri-coupon-3-line mr-1"></i>Tenho um convite
              </button>
            ))}

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