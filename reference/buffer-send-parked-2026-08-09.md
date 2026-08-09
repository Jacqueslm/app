# Buffer send — parked 9 Aug 2026, Jacques posts manually for now

Where it stopped, so resuming is a ten-minute job and not a fresh dig.

## What works, verified on his machine
- Buffer key connect + channel list (3 channels: YouTube, Facebook, TikTok)
- fal upload of the video (the 403 was an empty fal balance, since topped up)
- Thumbnail auto-generation (first frame → fal, permanent)
- Error reporting: Buffer's own words now reach the screen

## The one remaining break — and Buffer already told us the fix
His last send answered:

> Unknown type "PostCreateInput". Did you mean "PostCountsInput",
> "TagToCreateInput", "PostGroupInput", "PostSortInput", or "PostTemplateInput"?

So the MUTATION VARIABLE TYPE NAME is wrong — their API doesn't have
PostCreateInput (renamed, or never public). The mutation itself (`createPost`)
resolved fine. The introspection ALSO returned the full asset shapes, which
confirms the rest of the payload is right:

> AssetInput: document/image/link/video · VideoAssetInput: metadata:
> VideoMetadataInput, thumbnailUrl: String, url: String!

## To resume
Introspect what createPost actually takes, then use that name in
BUFFER_CREATE_Q (Studio/server/studio.js):

    query { __schema { mutationType { fields { name args { name type { kind name ofType { kind name } } } } } } }

…filter for name == "createPost", read args[0].type. One string change.
Consider doing that introspection at runtime (cached) so a future rename
never breaks it again.

## Manual posting in the meantime
Render → Download my video (or 📁 Open my media folder) → upload on each
platform. Titles: YOUTUBE-TITLES.md rule still applies — search title on
YouTube, hook on TikTok/Facebook. AI-made videos still need the platform's
AI toggle ticked by hand.
