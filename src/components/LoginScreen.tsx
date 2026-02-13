import { useEffect, useState } from "react"
import { AlertCircle, KeyRound, ShieldCheck } from "lucide-react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  ApiAuthError,
  completeMfaEnrollment,
  ensureDevSession,
  fetchBootstrapStatus,
  fetchAuthPolicy,
  fetchCurrentUser,
  loginWithPassword,
  registerFirstUser,
  startMfaEnrollment,
  type AuthPolicyRecord,
  type AuthUserRecord
} from "../lib/api"

interface LoginScreenProps {
  onAuthenticated: (user: AuthUserRecord) => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiAuthError) {
    const payload = error.payload as { error?: string; details?: { issues?: string[] } } | string
    if (typeof payload === "string") return payload
    if (Array.isArray(payload?.details?.issues) && payload.details.issues.length > 0) {
      return payload.details.issues.join(" ")
    }
    return payload?.error ?? error.message
  }

  return error instanceof Error ? error.message : "Authentication failed"
}

export function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [mfaCode, setMfaCode] = useState("")
  const [backupCode, setBackupCode] = useState("")
  const [useBackupCode, setUseBackupCode] = useState(false)
  const [requiresMfa, setRequiresMfa] = useState(false)
  const [requiresEnrollment, setRequiresEnrollment] = useState(false)
  const [enrollmentToken, setEnrollmentToken] = useState<string | null>(null)
  const [enrollmentSecret, setEnrollmentSecret] = useState<string | null>(null)
  const [enrollmentUri, setEnrollmentUri] = useState<string | null>(null)
  const [enrollmentBackupCodes, setEnrollmentBackupCodes] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [policy, setPolicy] = useState<AuthPolicyRecord | null>(null)
  const [hasUsers, setHasUsers] = useState<boolean | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [policyResponse, bootstrapResponse] = await Promise.all([fetchAuthPolicy(), fetchBootstrapStatus()])
        setPolicy(policyResponse.policy)
        setHasUsers(bootstrapResponse.hasUsers)
      } catch {
        // Endpoints are advisory for UX. Ignore failures.
        setHasUsers(true)
      }
    }

    void load()
  }, [])

  const isBootstrapMode = hasUsers === false

  const handleLogin = async () => {
    setIsLoading(true)
    setErrorMessage(null)

    try {
      await loginWithPassword({
        email,
        password,
        mfaCode: requiresMfa && !useBackupCode ? mfaCode : undefined,
        backupCode: requiresMfa && useBackupCode ? backupCode : undefined
      })
      const me = await fetchCurrentUser()
      onAuthenticated(me.user)
    } catch (error) {
      if (error instanceof ApiAuthError) {
        const payload = error.payload as {
          details?: { mfaRequired?: boolean; mfaEnrollmentRequired?: boolean }
        }

        if (payload?.details?.mfaRequired) {
          setRequiresMfa(true)
        }
        if (payload?.details?.mfaEnrollmentRequired) {
          setRequiresEnrollment(true)
        }
      }
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleBootstrapRegistration = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    setMessage(null)

    try {
      if (!fullName.trim()) {
        throw new Error("Full name is required.")
      }
      if (!email.trim()) {
        throw new Error("Email is required.")
      }
      if (!password) {
        throw new Error("Password is required.")
      }
      if (password !== confirmPassword) {
        throw new Error("Password and confirmation do not match.")
      }

      const response = await registerFirstUser({
        name: fullName.trim(),
        email: email.trim(),
        password,
        role: "ADMIN"
      })
      onAuthenticated(response.user)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleStartEnrollment = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const response = await startMfaEnrollment(email, password)
      setEnrollmentToken(response.enrollmentToken)
      setEnrollmentSecret(response.setup.secret)
      setEnrollmentUri(response.setup.otpAuthUrl)
      setRequiresEnrollment(true)
      setMessage("MFA enrollment started. Add the secret to your authenticator, then submit a code.")
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const [message, setMessage] = useState<string | null>(null)

  const handleCompleteEnrollment = async () => {
    if (!enrollmentToken) return
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const response = await completeMfaEnrollment(enrollmentToken, mfaCode.trim())
      setEnrollmentBackupCodes(response.backupCodes)
      onAuthenticated(response.user)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  const handleDevLogin = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      await ensureDevSession({ forceDevLogin: true })
      const me = await fetchCurrentUser()
      onAuthenticated(me.user)
    } catch (error) {
      setErrorMessage(getErrorMessage(error))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-slate-200 shadow-sm">
        <CardHeader className="space-y-2">
          <CardTitle className="text-xl flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700" />
            {isBootstrapMode ? "Create First Account" : "Sign In"}
          </CardTitle>
          <CardDescription>
            {isBootstrapMode
              ? "No users exist yet. Create the first administrator account to initialize the workspace."
              : "Authenticate to continue into RevenuePilot clinical workflows."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isBootstrapMode && (
            <div className="space-y-2">
              <Label htmlFor="bootstrap-name">Full Name</Label>
              <Input
                id="bootstrap-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Clinical Administrator"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="clinician@clinic.org"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {isBootstrapMode && (
            <div className="space-y-2">
              <Label htmlFor="bootstrap-confirm-password">Confirm Password</Label>
              <Input
                id="bootstrap-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Re-enter password"
              />
            </div>
          )}

          {!isBootstrapMode && (requiresMfa || (policy?.mfaRequired && !requiresEnrollment)) && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <Label htmlFor={useBackupCode ? "login-backup" : "login-mfa"}>
                  {useBackupCode ? "Backup Code" : "MFA Code"}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={() => setUseBackupCode((prev) => !prev)}
                >
                  {useBackupCode ? "Use MFA code" : "Use backup code"}
                </Button>
              </div>
              <Input
                id={useBackupCode ? "login-backup" : "login-mfa"}
                value={useBackupCode ? backupCode : mfaCode}
                onChange={(event) => {
                  if (useBackupCode) setBackupCode(event.target.value)
                  else setMfaCode(event.target.value)
                }}
                placeholder={useBackupCode ? "XXXX-XXXX" : "123456"}
              />
            </div>
          )}

          {!isBootstrapMode && requiresEnrollment && (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-900">MFA Enrollment Required</p>
              {!enrollmentToken ? (
                <p className="text-xs text-amber-800">Click "Start MFA Enrollment" to initialize your authenticator setup.</p>
              ) : (
                <>
                  {enrollmentSecret && (
                    <div className="text-xs">
                      <p className="text-amber-800 mb-1">Authenticator secret</p>
                      <code className="break-all">{enrollmentSecret}</code>
                    </div>
                  )}
                  {enrollmentUri && (
                    <a href={enrollmentUri} target="_blank" rel="noreferrer" className="text-xs underline text-amber-900">
                      Open otpauth URI
                    </a>
                  )}
                  <Input
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    placeholder="Enter 6-digit authenticator code"
                  />
                </>
              )}
            </div>
          )}

          {message && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </div>
          )}

          {!isBootstrapMode && enrollmentBackupCodes.length > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 space-y-1">
              <p className="font-medium">Backup codes (save now)</p>
              <div className="grid grid-cols-2 gap-1">
                {enrollmentBackupCodes.map((code) => (
                  <code key={code}>{code}</code>
                ))}
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isBootstrapMode ? (
            <Button
              type="button"
              className="w-full"
              disabled={isLoading || !fullName.trim() || !email.trim() || !password || !confirmPassword}
              onClick={handleBootstrapRegistration}
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {isLoading ? "Creating Account..." : "Create First Admin Account"}
            </Button>
          ) : !requiresEnrollment ? (
            <Button
              type="button"
              className="w-full"
              disabled={isLoading || !email.trim() || !password}
              onClick={handleLogin}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>
          ) : !enrollmentToken ? (
            <Button
              type="button"
              className="w-full"
              disabled={isLoading || !email.trim() || !password}
              onClick={handleStartEnrollment}
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {isLoading ? "Starting Enrollment..." : "Start MFA Enrollment"}
            </Button>
          ) : (
            <Button
              type="button"
              className="w-full"
              disabled={isLoading || mfaCode.trim().length < 6}
              onClick={handleCompleteEnrollment}
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {isLoading ? "Completing Enrollment..." : "Complete MFA Enrollment"}
            </Button>
          )}

          {!isBootstrapMode && policy?.allowDevLogin && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={isLoading}
              onClick={handleDevLogin}
            >
              Use Dev Login
            </Button>
          )}

          <div className="text-xs text-slate-500 space-y-1">
            {policy?.passwordMinLength ? (
              <p>Password policy: minimum {policy.passwordMinLength} characters with complexity rules.</p>
            ) : (
              <p>Password and MFA policies are enforced by the backend environment.</p>
            )}
            {!isBootstrapMode && policy?.mfaRequired && <p>MFA is required for this environment.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
