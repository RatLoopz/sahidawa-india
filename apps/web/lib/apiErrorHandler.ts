import { toast } from "sonner";

export async function handleApiError(
    error: unknown,
    fallbackMessage = "Something went wrong"
): Promise<void> {
    try {
        if (process.env.NODE_ENV === "development") {
            console.error(error);
        }

        if (error instanceof Response) {
            try {
                const data = await error.clone().json();

                const message = data?.message ?? data?.error ?? fallbackMessage;

                toast.error(message);
                return;
            } catch {
                toast.error(fallbackMessage);
                return;
            }
        }

        if (error instanceof Error) {
            toast.error(error.message);
            return;
        }

        if (typeof error === "string") {
            toast.error(error);
            return;
        }

        toast.error(fallbackMessage);
    } catch {
        toast.error(fallbackMessage);
    }
}
