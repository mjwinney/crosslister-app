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

    // let client;
    // let clientPromise;

    // if (process.env.NODE_ENV === 'development') {
    //     // In development mode, use a global variable to preserve the client across HMR reloads
    //     if (!(global as any)._mongoClientPromise) {
    //         client = new MongoClient(uri, options);
    //         (global as any)._mongoClientPromise = client.connect();
    //     }
    //     clientPromise = (global as any)._mongoClientPromise;
    // } else {
        // In production mode, do not use a global variable
    const client = new MongoClient(uri, options);
        // clientPromise = client.connect();
    // }

    export default client;
