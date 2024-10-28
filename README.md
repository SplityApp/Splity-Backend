1. Install supabase cli (for development) `brew install supabase/tap/supabase`
2. Login to supabase `supabase login`
3. Link supabase to project `supabase link`
4. Install Deno `brew install deno`
5. Install Deno extension for VSCode
6. Create new function `supabase functions new my_function`
7. Run function locally `cd supabase/functions/my_function`
   `deno run --allow-all --watch index.ts`
8. Deploy function
   `supabase functions deploy my_function --project-ref bajqihucgsmrbpagxhvv`

# Tutorials

https://supabase.com/docs/guides/functions/local-development
https://www.youtube.com/watch?v=lFhU3L8VoSQ
