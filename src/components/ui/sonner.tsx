import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// O app é sempre escuro: sem next-themes
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5 text-positive" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5 text-warning" />,
        error: <OctagonXIcon className="size-5 text-negative" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "rgb(255 255 255 / 0.1)",
          "--border-radius": "calc(var(--radius) * 1.5)",
        } as React.CSSProperties
      }
      toastOptions={{
        // Um pouco maior que o padrão do Sonner (13 px), com sombra para destacar do fundo escuro.
        // O Sonner injeta estilos próprios: as classes precisam de ! para valer
        classNames: {
          toast: "cn-toast gap-2! px-4! py-4.5! text-[0.9375rem]! shadow-[0_16px_40px_-12px_rgb(0_0_0/0.9)]!",
          icon: "size-5!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
