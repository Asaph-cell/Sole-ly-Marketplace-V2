import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SEO } from "@/components/SEO";

const Contact = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Create mailto link with form data
    const supportEmail = "contact@solelymarketplace.com";
    const subject = encodeURIComponent(`Contact Form: Message from ${formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`
    );

    // Open user's email client with pre-filled content
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

    toast.success("Opening your email client...");
    setFormData({ name: "", email: "", message: "" });
  };

  return (
    <div className="min-h-screen py-12">
      <SEO
        title="Contact Us"
        description="Contact Solely Marketplace for complaints, inquiries, or support. We respond to all inquiries within 24 hours. Email us at contact@solelymarketplace.com."
        canonical="https://solelymarketplace.com/contact"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Contact", url: "/contact" }
        ]}
      />
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Contact Us</h1>
            <p className="text-xl text-muted-foreground">
              For complaints, inquiries, or general support, please reach out via email.
            </p>
          </div>

          {/* Contact Form */}
          <Card className="border-2 shadow-card">
            <CardHeader>
              <CardTitle className="text-2xl">Send Us a Message</CardTitle>
              <p className="text-muted-foreground">
                We respond to all inquiries within 24 hours
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold mb-2">
                    Your Name
                  </label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold mb-2">
                    Email Address
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-semibold mb-2">
                    Your Message
                  </label>
                  <Textarea
                    id="message"
                    placeholder="Tell us about your complaint, inquiry, or concern..."
                    rows={8}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" size="lg" className="w-full">
                  <Mail size={20} strokeWidth={1.5} className="mr-2 " />
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Email Info */}
          <div className="mt-8 text-center">
            <Card className="border-2 shadow-card bg-muted/50">
              <CardContent className="py-6">
                <Mail strokeWidth={1.5} className="h-8 w-8 text-primary mx-auto mb-3" />
                <p className="text-lg font-semibold mb-2">Email Us Directly</p>
                <a
                  href="mailto:contact@solelymarketplace.com"
                  className="text-primary hover:underline text-lg"
                >
                  contact@solelymarketplace.com
                </a>
                <p className="text-sm text-muted-foreground mt-3">
                  For complaints, support requests, or general inquiries
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
