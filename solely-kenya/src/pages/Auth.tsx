import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mail, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import logo from "@/assets/solely-logo.svg";

// Production URL for email verification redirect
const SITE_URL = "https://solelymarketplace.com";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetEmailSent, setShowResetEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  let redirectTo = searchParams.get("redirect") || "/";
  
  // Fix double base path on GitHub Pages
  const baseUrl = import.meta.env.BASE_URL;
  if (baseUrl && baseUrl !== '/' && redirectTo.startsWith(baseUrl)) {
    redirectTo = '/' + redirectTo.slice(baseUrl.length);
  }
  // Ensure it starts with a single slash
  redirectTo = redirectTo.replace(/(?<!:)\/+/g, '/');

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}${redirectTo.replace(/^\/+/, '')}`.replace(/(?<!:)\/+/g, '/'),
        },
      });
      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  useEffect(() => {
    const checkUser = async () => {
      // Small delay to ensure signOut has completed if coming from logout
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use getUser() to ensure the token is actually valid on the server,
      // preventing infinite loops if localStorage has an invalid old token.
      const { data: { user }, error } = await supabase.auth.getUser();
      if (user && !error) {
        navigate(redirectTo);
      } else {
        // If there's a session in storage but getUser fails, sign out to clear it
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await supabase.auth.signOut();
        }
      }
    };
    checkUser();
  }, [navigate, redirectTo]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!termsAccepted) {
      toast.error("You must accept the Terms & Conditions to create an account");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}${redirectTo.replace(/^\/+/, '')}`.replace(/(?<!:)\/+/g, '/')
        }
      });

      if (error) throw error;

      if (data.user) {
        // Create customer profile
        await supabase.from("profiles").upsert({
          id: data.user.id,
          full_name: fullName,
        });

        // Show prominent email verification message
        setRegisteredEmail(email);
        setShowEmailSent(true);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Welcome back!");
      navigate(redirectTo);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}reset-password`.replace(/(?<!:)\/+/g, '/'),
      });

      if (error) throw error;

      setRegisteredEmail(email);
      setShowResetEmailSent(true);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show password reset email sent screen
  if (showResetEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <KeyRound size={32} strokeWidth={1.5} className="text-primary" />
            </div>
            <CardTitle className="text-2xl text-blue-700">Check Your Email!</CardTitle>
            <CardDescription className="text-base mt-2">
              We've sent a password reset link to:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email display */}
            <div className="bg-muted/50 border rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                <Mail size={20} strokeWidth={1.5} className=" text-primary" />
                <span>{registeredEmail}</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
              <p className="text-blue-800 font-medium">
                📧 Click the link in your email to reset your password.
              </p>
            </div>

            {/* Didn't receive email */}
            <div className="text-center text-sm text-muted-foreground">
              <p>Didn't receive the email? Check your spam folder.</p>
            </div>

            {/* Back to sign in */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowResetEmailSent(false);
                setShowForgotPassword(false);
                setEmail("");
              }}
            >
              <ArrowLeft size={16} strokeWidth={1.5} className=" mr-2" />
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img src={logo} alt="Solely Marketplace" className="h-16 w-auto mx-auto mb-4" />
            <CardTitle className="text-2xl">Forgot Password?</CardTitle>
            <CardDescription>
              Enter your email and we'll send you a link to reset your password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowForgotPassword(false);
                  setEmail("");
                }}
              >
                <ArrowLeft size={16} strokeWidth={1.5} className=" mr-2" />
                Back to Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show email verification success screen
  if (showEmailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <CheckCircle2 size={32} strokeWidth={1.5} className="text-primary" />
            </div>
            <CardTitle className="text-2xl text-green-700">Check Your Email!</CardTitle>
            <CardDescription className="text-base mt-2">
              We've sent a verification link to:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Email display */}
            <div className="bg-muted/50 border rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-lg font-semibold">
                <Mail size={20} strokeWidth={1.5} className=" text-primary" />
                <span>{registeredEmail}</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-amber-800 font-medium">
                📧 Please check your email and click the verification link to activate your account.
              </p>
            </div>

            {/* Didn't receive email */}
            <div className="text-center text-sm text-muted-foreground">
              <p>Didn't receive the email? Check your spam folder.</p>
            </div>

            {/* Back to sign in */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setShowEmailSent(false);
                setEmail("");
                setPassword("");
                setFullName("");
                setTermsAccepted(false);
              }}
            >
              Back to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 pb-28 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="Solely Marketplace" className="h-16 w-auto mx-auto mb-4" />
          <CardTitle className="text-2xl">Welcome to Solely</CardTitle>
          <CardDescription>Sign in or create an account to start shopping</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot your password?
                  </button>
                </div>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* Google Sign In */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="fullname">Full Name</Label>
                  <Input
                    id="fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div className="flex items-start space-x-3 pt-2">
                  <Checkbox
                    id="buyer-terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5"
                  />
                  <Label htmlFor="buyer-terms" className="text-sm font-normal leading-relaxed">
                    I agree to the{" "}
                    <Link to="/terms" target="_blank" className="text-primary underline hover:no-underline">
                      Terms & Conditions
                    </Link>
                  </Label>
                </div>

                <Button type="submit" className="w-full" disabled={loading || !termsAccepted}>
                  {loading ? "Creating account..." : "Sign Up"}
                </Button>

                {/* Divider */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>

                {/* Google Sign Up */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogleSignIn}
                  disabled={!termsAccepted}
                >
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign up with Google
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
