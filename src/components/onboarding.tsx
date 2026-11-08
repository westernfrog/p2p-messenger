import { useRef, useState, type ReactNode } from 'react'
import { AvatarGrid } from '@/components/avatar-grid'
import { Avatar } from '@/components/avatar'
import { Mark } from '@/components/mark'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { actions } from '@/lib/app'
import { ArrowLeftIcon, KeyIcon, LockSimpleIcon, QrCodeIcon } from '@/lib/icons'

/**
 * First run, in two short steps (onboarding.md: "fast, fun, and optional"): what the app is in
 * three lines, then a name and a character. Pairing is taught where it happens, on the empty
 * chat list, not here.
 */
export function Onboarding() {
  const pending = useRef(actions.newIdentity()).current
  const [step, setStep] = useState<'welcome' | 'profile'>('welcome')
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(pending.avatar)

  return (
    <main className="grid min-h-dvh place-items-center bg-window px-4 py-[max(2rem,env(safe-area-inset-top))]">
      {step === 'welcome' ? (
        <div key="welcome" className="grid w-full max-w-[25rem] gap-8 animate-[row-in_0.35s_var(--ease-out-soft)]">
          <div className="grid justify-items-center gap-4 text-center">
            <Mark size={64} />
            <div className="grid gap-1.5">
              <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">Welcome to Messenger</h1>
              <p className="text-[15px] text-muted-foreground md:text-sm">Private chat, straight between devices.</p>
            </div>
          </div>

          <ul className="grid gap-5">
            <Feature icon={<LockSimpleIcon weight="fill" />} title="Nothing in between">
              Messages go directly from your device to theirs. No server ever stores them.
            </Feature>
            <Feature icon={<KeyIcon weight="fill" />} title="No account">
              No phone number or email. Your private key is made on this device and stays here.
            </Feature>
            <Feature icon={<QrCodeIcon weight="fill" />} title="Add people in person">
              Scan each other’s code once, then chat from anywhere.
            </Feature>
          </ul>

          <Button size="lg" className="h-11 w-full text-[15px] font-semibold" onClick={() => setStep('profile')} autoFocus>
            Continue
          </Button>
        </div>
      ) : (
        <form
          key="profile"
          className="grid w-full max-w-[25rem] gap-5 animate-[row-in_0.35s_var(--ease-out-soft)]"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) actions.createProfile(name, avatar, pending)
          }}
        >
          <div className="relative grid justify-items-center gap-3 text-center">
            <Button
              type="button"
              variant="ghost"
              className="absolute top-0 left-0 text-link"
              onClick={() => setStep('welcome')}
            >
              <ArrowLeftIcon />
              Back
            </Button>
            <Avatar pk={pending.pk} mascot={avatar} size={88} className="mt-6" />
            <div className="grid gap-1">
              <h1 className="text-[1.5rem] leading-tight font-bold tracking-[-0.02em]">Your profile</h1>
              <p className="text-[15px] text-muted-foreground md:text-sm">People you add see your name and character.</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-group bg-group shadow-group">
            <label className="grid gap-1.5 p-3.5">
              <span className="text-[13px] font-semibold">Name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="nickname"
                autoCapitalize="words"
                enterKeyHint="done"
                placeholder="Your first name or a nickname"
                required
                autoFocus={matchMedia('(pointer: fine)').matches}
                className="h-10"
              />
            </label>
            <div className="border-t border-separator px-3.5 pt-3">
              <span className="text-[13px] font-semibold">Character</span>
            </div>
            <AvatarGrid value={avatar} onChange={setAvatar} className="max-h-56 overflow-y-auto p-3.5" />
          </div>

          <Button type="submit" size="lg" className="h-11 w-full text-[15px] font-semibold" disabled={!name.trim()}>
            Start Messaging
          </Button>
        </form>
      )}
    </main>
  )
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-group bg-[color-mix(in_srgb,var(--sig-blue)_14%,transparent)] text-sig-blue-ink [&_svg]:size-5">
        {icon}
      </span>
      <div className="grid gap-0.5">
        <p className="text-[15px] font-semibold md:text-sm">{title}</p>
        <p className="text-[15px] leading-snug text-muted-foreground md:text-sm">{children}</p>
      </div>
    </li>
  )
}
