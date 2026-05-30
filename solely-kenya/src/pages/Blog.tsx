import { blogPosts } from "@/data/blogPosts";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { motion } from "framer-motion";
import { Clock, User, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

const Blog = () => {
    return (
        <div className="min-h-screen py-12 bg-background">
            <SEO 
                title="Solely Blog | The Nairobi Footwear Guide"
                description="Expert tips on sneaker care, escrow security, and scaling your shoe business in Kenya. Relatable stories for Nairobi's footwear culture."
                canonical="https://solelymarketplace.com/blog"
            />
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="max-w-3xl mx-auto text-center mb-16">
                    <h1 className="text-4xl md:text-6xl font-black mb-4 pb-6 pt-2 bg-gradient-to-r from-primary via-primary/95 to-primary/80 bg-clip-text text-transparent italic leading-[1.2]">
                        Solely Blog
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        Your street-smart guide to the Nairobi footwear scene, from the hustle to the heat.
                    </p>
                    <div className="mt-6 flex justify-center gap-4">
                      <Badge variant="outline" className="px-3 py-1 text-sm">#MatatuHustle</Badge>
                      <Badge variant="outline" className="px-3 py-1 text-sm">#StiffCulture</Badge>
                      <Badge variant="outline" className="px-3 py-1 text-sm">#SolelyNairobi</Badge>
                    </div>
                </div>

                {/* Blog Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {blogPosts.map((post, index) => (
                        <motion.div
                            key={post.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Link to={`/blog/${post.id}`} className="group">
                                <Card className="h-full overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 flex flex-col shadow-soft hover:shadow-hover">
                                    <div className="aspect-video relative overflow-hidden">
                                        <img 
                                            src={post.image} 
                                            alt={post.title} 
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        />
                                        <div className="absolute top-4 left-4">
                                            <Badge className="bg-primary text-primary-foreground shadow-lg">
                                                {post.category}
                                            </Badge>
                                        </div>
                                    </div>
                                    <CardContent className="p-6 flex-grow">
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                                            <span className="flex items-center gap-1">
                                                <Calendar strokeWidth={1.5} className="h-3 w-3" />
                                                {post.date}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock strokeWidth={1.5} className="h-3 w-3" />
                                                {post.readTime}
                                            </span>
                                        </div>
                                        <h2 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                                            {post.title}
                                        </h2>
                                        <p className="text-sm text-muted-foreground line-clamp-3">
                                            {post.excerpt}
                                        </p>
                                    </CardContent>
                                    <CardFooter className="p-6 pt-0 flex items-center justify-between border-t border-border/50 mt-auto">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User size={16} strokeWidth={1.5} className=" text-primary" />
                                            </div>
                                            <span className="text-xs font-semibold">{post.author}</span>
                                        </div>
                                        <span className="text-xs font-bold text-primary group-hover:underline">Read More →</span>
                                    </CardFooter>
                                </Card>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* Vendor CTA */}
                <div className="mt-20 p-8 md:p-12 rounded-3xl bg-secondary text-secondary-foreground text-center relative overflow-hidden border-2 border-primary/20">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                  <h3 className="text-2xl md:text-3xl font-bold mb-4 italic">Turn Your Kicks into Cash</h3>
                  <p className="opacity-90 mb-8 max-w-xl mx-auto text-base">
                    Have a collection you're ready to move? Join Nairobi's fastest-growing shoe marketplace and start selling with zero upfront fees.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild size="lg" className="bg-primary text-primary-foreground px-10 rounded-full font-bold hover:shadow-xl transition-all h-14 text-lg">
                      <Link to="/vendor">Start Selling Today</Link>
                    </Button>
                  </div>
                </div>
            </div>
        </div>
    );
};

export default Blog;
