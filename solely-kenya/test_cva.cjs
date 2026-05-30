const { cva } = require('class-variance-authority');

const alertVariants = cva("base-class", {
  variants: {
    variant: {
      default: "bg-default",
      destructive: "bg-destructive",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

try {
  console.log(alertVariants({ variant: "info" }));
} catch (e) {
  console.log("Error:", e.message);
}
