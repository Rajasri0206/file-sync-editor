import { useState } from "react";
import { Link, useLocation } from "wouter";
import { PlayCircle, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { useRegisterUser, useLoginUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function LoginPage() {
  const { login } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [showPwd, setShowPwd] = useState(false);

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    email: "",
    username: "",
    password: "",
    role: "student" as const,
    purpose: "general",
  });

  const loginMutation = useLoginUser();
  const registerMutation = useRegisterUser();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await loginMutation.mutateAsync({ data: loginForm });
      login({
        userId: res.user.id,
        username: res.user.username,
        email: res.user.email,
        role: res.user.role,
        purpose: res.user.purpose,
        token: res.token,
      });
      toast({ title: "Welcome back!", description: `Signed in as ${res.user.username}` });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err?.message ?? "Invalid email or password.",
        variant: "destructive",
      });
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await registerMutation.mutateAsync({ data: registerForm });
      login({
        userId: res.user.id,
        username: res.user.username,
        email: res.user.email,
        role: res.user.role,
        purpose: res.user.purpose,
        token: res.token,
      });
      toast({ title: "Account created!", description: `Welcome, ${res.user.username}!` });
      navigate("/");
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err?.message ?? "Could not create account.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <PlayCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">EchoCoach</h1>
          <p className="text-muted-foreground mt-1">Your AI speaking coach</p>
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardContent className="pt-6">
            <Tabs defaultValue="login">
              <TabsList className="w-full mb-6">
                <TabsTrigger value="login" className="flex-1">Sign In</TabsTrigger>
                <TabsTrigger value="register" className="flex-1">Create Account</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="you@example.com"
                      value={loginForm.email}
                      onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-pwd">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-pwd"
                        type={showPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={loginForm.password}
                        onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPwd(!showPwd)}
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
                    {loginMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign In
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      type="email"
                      placeholder="you@example.com"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-username">Username</Label>
                    <Input
                      id="reg-username"
                      placeholder="speakerPro99"
                      value={registerForm.username}
                      onChange={(e) => setRegisterForm((f) => ({ ...f, username: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reg-pwd">Password</Label>
                    <div className="relative">
                      <Input
                        id="reg-pwd"
                        type={showPwd ? "text" : "password"}
                        placeholder="••••••••"
                        value={registerForm.password}
                        onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPwd(!showPwd)}
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select
                        value={registerForm.role}
                        onValueChange={(v) => setRegisterForm((f) => ({ ...f, role: v as typeof f.role }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="teacher">Teacher</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Purpose</Label>
                      <Select
                        value={registerForm.purpose}
                        onValueChange={(v) => setRegisterForm((f) => ({ ...f, purpose: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="general">General</SelectItem>
                          <SelectItem value="academic">Academic</SelectItem>
                          <SelectItem value="business">Business</SelectItem>
                          <SelectItem value="esl">ESL Practice</SelectItem>
                          <SelectItem value="presentation">Presentations</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                    {registerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={14} />
            Continue as Demo User
          </Link>
        </div>
      </div>
    </div>
  );
}
