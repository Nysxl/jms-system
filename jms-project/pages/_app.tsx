import type { AppProps } from 'next/app';
import '../styles/stylesglobals.css';

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
