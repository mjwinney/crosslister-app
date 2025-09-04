    // src/lib/server/db.js
    import { MongoClient } from 'mongodb';
    import { MONGODB_URI } from '$env/static/private'; // For accessing environment variables

    if (!MONGODB_URI) {
        throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
    }


    const uri = MONGODB_URI;
    const options = {
        // Add any necessary options here, e.g., serverApi for specific versions
    };

    const client = new MongoClient(uri, options);

    export default client;
