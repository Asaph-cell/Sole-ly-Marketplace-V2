import { useParams, Link, useNavigate } from "react-router-dom";
import { blogPosts } from "@/data/blogPosts";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  ChevronLeft, 
  Share2, 
  Clock, 
  User, 
  Calendar, 
  MessageCircle, 
  ThumbsUp, 
  Reply, 
  Send,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
  likes: number;
  isLiked?: boolean;
  replies?: Comment[];
}

const BlogPost = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const post = blogPosts.find((p) => p.id === id);

  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [suggestionSubmitted, setSuggestionSubmitted] = useState(false);
  const [topicIdea, setTopicIdea] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sidebarProducts, setSidebarProducts] = useState<any[]>([]);

  useEffect(() => {
    const fetchSidebarProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price_ksh, images")
        .eq("status", "active")
        .limit(2);
      
      if (!error && data) {
        setSidebarProducts(data);
      }
    };
    fetchSidebarProducts();
  }, []);

  const [comments, setComments] = useState<Comment[]>(post.comments);
  const [newComment, setNewComment] = useState("");

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Post Not Found</h1>
        <Button onClick={() => navigate("/blog")}>Back to Blog</Button>
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.excerpt,
        url: window.location.href,
      }).catch(err => {
        console.error("Error sharing:", err);
        toast.error("Could not open share menu");
      });
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  const handleWhatsAppShare = () => {
    const text = `Check out this Solely Blog post: ${post.title}\n\n${window.location.href}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      author: "You",
      text: newComment,
      date: "Just now",
      likes: 0,
      isLiked: false
    };
    
    setComments([comment, ...comments]);
    setNewComment("");
    toast.success("Comment posted to the community!");
  };

  const handleLike = (commentId: string) => {
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return { ...c, likes: c.isLiked ? c.likes - 1 : c.likes + 1, isLiked: !c.isLiked };
      }
      if (c.replies) {
        return { ...c, replies: c.replies.map(r => r.id === commentId ? { ...r, likes: r.isLiked ? r.likes - 1 : r.likes + 1, isLiked: !r.isLiked } : r) };
      }
      return c;
    }));
  };

  const handlePostReply = (commentId: string) => {
    if (!replyText.trim()) return;
    
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        const newReply: Comment = {
          id: Date.now().toString(),
          author: "You",
          text: replyText,
          date: "Just now",
          likes: 0,
          isLiked: false
        };
        return { ...c, replies: [...(c.replies || []), newReply] };
      }
      return c;
    }));
    
    setReplyText("");
    setReplyTo(null);
    toast.success("Reply posted!");
  };

  const handleSuggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicIdea.trim()) return;
    
    try {
      const { error } = await supabase
        .from("company_feedback")
        .insert({ message: topicIdea.trim() });
      
      if (error) throw error;

      setSuggestionSubmitted(true);
      setTopicIdea("");
      toast.success("Feedback received! We appreciate your help in building Solely.");
      
      // Reset after some time
      setTimeout(() => setSuggestionSubmitted(false), 5000);
    } catch (err: any) {
      console.error("Feedback error:", err);
      toast.error("Could not send feedback, but we're working on it!");
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-background pt-8">
      <SEO 
        title={`${post.title} | Solely Blog`}
        description={post.metaDescription}
        keywords={post.keywords}
        image={post.image}
        type="article"
        canonical={`https://solelymarketplace.com/blog/${post.id}`}
      />
      
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-primary/10 z-50">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: "45%" }}
          className="h-full bg-primary" 
        />
      </div>

      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Main Content Column */}
          <div className="lg:w-2/3">
            {/* Navigation */}
            <Link 
              to="/blog" 
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-8 group"
            >
              <ChevronLeft size={16} strokeWidth={1.5} className=" transition-transform group-hover:-translate-x-1" />
              Back to Blog
            </Link>

            {/* Header */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-10"
            >
              <Badge className="mb-6 bg-primary text-primary-foreground shadow-lg px-4 py-1">
                {post.category}
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold mb-6 italic leading-[1.2] pb-2">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground border-b border-border pb-6">
                <span className="flex items-center gap-1.5"><User size={16} strokeWidth={1.5}  /> {post.author}</span>
                <span className="flex items-center gap-1.5"><Calendar size={16} strokeWidth={1.5}  /> {post.date}</span>
                <span className="flex items-center gap-1.5"><Clock size={16} strokeWidth={1.5}  /> {post.readTime}</span>
              </div>
            </motion.div>

            {/* Featured Image */}
            <div className="relative aspect-video rounded-3xl overflow-hidden mb-12 shadow-2xl">
              <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
            </div>

            {/* Content */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-16">
              <div dangerouslySetInnerHTML={{ __html: post.content }} className="blog-content leading-relaxed space-y-6 text-foreground/90" />
            </div>

            {/* Community Section: Comments (Foldable) */}
            <section className="bg-card/30 rounded-3xl border-2 border-primary/10 overflow-hidden">
              <button 
                onClick={() => setIsCommentsOpen(!isCommentsOpen)}
                className="w-full flex items-center justify-between p-6 sm:p-10 hover:bg-primary/5 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle size={24} strokeWidth={1.5} className=" text-primary" />
                  <h3 className="text-2xl font-bold italic">Community Conversation ({comments.reduce((acc, c) => acc + 1 + (c.replies?.length || 0), 0)})</h3>
                </div>
                {isCommentsOpen ? <ChevronUp size={24} strokeWidth={1.5}  /> : <ChevronDown size={24} strokeWidth={1.5}  />}
              </button>

              <AnimatePresence>
                {isCommentsOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="px-6 sm:px-10 pb-10 overflow-hidden"
                  >
                    {/* Comment Input */}
                    <form onSubmit={handlePostComment} className="mb-12 mt-4">
                      <div className="relative">
                        <Textarea 
                          placeholder="Join the hustle conversation... What do you think?"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="min-h-[100px] rounded-2xl bg-background border-2 focus:border-primary transition-all p-4 text-base"
                        />
                        <div className="flex justify-end mt-3">
                          <Button type="submit" size="sm" className="rounded-full gap-2 font-bold px-6">
                            <Send size={16} strokeWidth={1.5}  /> Post Comment
                          </Button>
                        </div>
                      </div>
                    </form>

                    {/* Comments List */}
                    <div className="space-y-8">
                      {comments.map((comment) => (
                        <div key={comment.id} className="space-y-4">
                          <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User size={20} strokeWidth={1.5} className=" text-primary" />
                            </div>
                            <div className="flex-grow">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-bold">{comment.author}</span>
                                <span className="text-xs text-muted-foreground">{comment.date}</span>
                              </div>
                              <p className="text-muted-foreground text-[15px] mb-3">{comment.text}</p>
                              <div className="flex items-center gap-4 text-xs font-bold">
                                <button 
                                  onClick={() => handleLike(comment.id)}
                                  className={`flex items-center gap-1 transition-colors ${comment.isLiked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                >
                                  <ThumbsUp size={14} strokeWidth={1.5} className={` ${comment.isLiked ? 'fill-primary' : ''}`} /> {comment.likes}
                                </button>
                                <button 
                                  onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)}
                                  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                                >
                                  <Reply size={14} strokeWidth={1.5}  /> Reply
                                </button>
                              </div>

                              {/* Reply Input */}
                              {replyTo === comment.id && (
                                <div className="mt-4 flex gap-2">
                                  <Input 
                                    placeholder="Write a reply..." 
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    className="rounded-full h-9 text-xs"
                                    autoFocus
                                  />
                                  <Button size="sm" onClick={() => handlePostReply(comment.id)} className="rounded-full h-9 px-4">Send</Button>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Replies */}
                          {comment.replies?.map((reply) => (
                            <div key={reply.id} className="ml-14 flex gap-4 border-l-2 border-primary/10 pl-4 py-2">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <User size={16} strokeWidth={1.5} className=" text-muted-foreground" />
                              </div>
                              <div className="flex-grow">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-sm">{reply.author}</span>
                                  {reply.author === "Solely Expert" && (
                                    <Badge variant="outline" className="text-[9px] h-4 py-0 px-1 border-primary/50 text-primary">STAFF</Badge>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">{reply.date}</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{reply.text}</p>
                                <button 
                                  onClick={() => handleLike(reply.id)}
                                  className={`flex items-center gap-1 text-[10px] font-bold transition-colors ${reply.isLiked ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
                                >
                                  <ThumbsUp strokeWidth={1.5} className={`h-3 w-3 ${reply.isLiked ? 'fill-primary' : ''}`} /> {reply.likes}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          {/* Sidebar Column */}
          <div className="lg:w-1/3 space-y-8">
            {/* Share Tool */}
            <Card className="p-6 border-2 border-primary/10 shadow-soft">
              <h4 className="font-bold mb-4 italic">Spread the Word</h4>
              <p className="text-sm text-muted-foreground mb-6">Found this helpful? Share it with the squad so everyone can stay stiff.</p>
              <div className="flex flex-col gap-3">
                <Button onClick={handleShare} className="w-full rounded-full gap-2 font-bold bg-primary hover:shadow-lg transition-all">
                  <Share2 size={16} strokeWidth={1.5}  /> Share Article
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleWhatsAppShare}
                  className="w-full rounded-full gap-2 font-bold border-2"
                >
                   WhatsApp Group
                </Button>
              </div>
            </Card>

            {/* Suggest a Topic */}
            {/* Topic Suggestion sidebar */}
            <Card className="p-6 border-2 border-primary/10 shadow-soft overflow-hidden">
              <AnimatePresence mode="wait">
                {!suggestionSubmitted ? (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <Lightbulb size={20} strokeWidth={1.5} className=" fill-current" />
                      <h4 className="font-bold italic">How can we improve?</h4>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      What should we, as a company, improve on? We're building Solely for you.
                    </p>
                    <form onSubmit={handleSuggest} className="space-y-3">
                      <Input
                        placeholder="e.g. Add more sneaker cleaning tips..."
                        value={topicIdea}
                        onChange={(e) => setTopicIdea(e.target.value)}
                        className="rounded-xl border-2 focus:ring-primary shadow-inner"
                      />
                      <Button type="submit" className="w-full rounded-full gap-2 font-bold shadow-soft hover:shadow-lg transition-all">
                        Submit Feedback
                      </Button>
                    </form>
                  </motion.div>
                ) : (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-4 space-y-3"
                  >
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 size={24} strokeWidth={1.5}  />
                    </div>
                    <h4 className="font-bold">Feedback Received!</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Your response has been sent to our management team. Thank you for helping us grow!
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>

            {/* Related Products Sidebar - ACTUAL INVENTORY */}
            <div className="space-y-4">
              <h4 className="font-bold italic px-2">Stiff Picks for this Guide</h4>
              <div className="grid gap-4">
                {sidebarProducts.length > 0 ? sidebarProducts.map((product) => (
                  <div key={product.id} className="group p-4 bg-card rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-muted overflow-hidden shrink-0">
                      <img 
                        src={product.images?.[0] || "/placeholder.svg"} 
                        className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                        alt={product.name} 
                      />
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="font-bold text-sm truncate group-hover:text-primary transition-colors">{product.name}</h5>
                      <p className="text-xs text-muted-foreground font-semibold">KES {product.price_ksh.toLocaleString()}</p>
                      <Link to={`/product/${product.id}`} className="text-[10px] font-bold text-primary mt-1 block hover:underline">View in Shop →</Link>
                    </div>
                  </div>
                )) : (
                  <div className="p-4 border-2 border-dashed border-primary/10 rounded-2xl text-center">
                    <p className="text-[10px] text-muted-foreground">Checking store inventory...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Community Link */}
            {/* Community Link */}
            <div className="p-8 rounded-3xl bg-primary text-primary-foreground shadow-soft relative overflow-hidden border-2 border-primary/20">
               <h4 className="text-2xl font-black mb-6 italic tracking-tight">Join the Squad</h4>
               <p className="text-base opacity-95 mb-8 leading-relaxed font-medium">
                  Follow us on Instagram for daily drops, behind-the-scenes, and Nairobi sneaker heat.
               </p>
               <Button asChild className="w-full bg-black hover:bg-black/90 text-white font-bold rounded-full shadow-lg h-14 text-lg border-none">
                  <a href="https://instagram.com/solely.kenya" target="_blank" rel="noopener noreferrer">Follow @solely.kenya</a>
               </Button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default BlogPost;
