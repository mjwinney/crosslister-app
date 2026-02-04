
export const POST = async ({ request }) => {
    console.log('POST: ENTER');
    const data = await request.json();
    console.log(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true }));
};
