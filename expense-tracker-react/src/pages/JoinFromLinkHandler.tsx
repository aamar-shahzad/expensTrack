import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { parseInviteInput } from '@/lib/invite';
import { useAccountStore } from '@/stores/accountStore';

/**
 * Handles /join?account=xxx&name=yyy when user is already onboarded.
 * Creates the account, switches to it, and navigates to Sync page.
 */
export function JoinFromLinkHandler() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const createAccountWithId = useAccountStore(s => s.createAccountWithId);
  const setCurrentAccount = useAccountStore(s => s.setCurrentAccount);

  useEffect(() => {
    const account = searchParams.get('account');
    const name = searchParams.get('name');
    if (!account) {
      navigate('/', { replace: true });
      return;
    }
    const parsed = parseInviteInput(`?account=${account}&name=${name || 'Shared Group'}`);
    if (parsed) {
      createAccountWithId(parsed.accountId, parsed.accountName, 'shared', '$');
      setCurrentAccount(parsed.accountId).then(async () => {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for Yjs doc to switch
        navigate('/sync', { replace: true, state: { joinData: parsed } });
      });
    } else {
      navigate('/', { replace: true });
    }
  }, [searchParams, createAccountWithId, setCurrentAccount, navigate]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[var(--teal-green)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[var(--text-secondary)]">Joining group...</p>
      </div>
    </div>
  );
}
