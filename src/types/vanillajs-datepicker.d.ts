declare module 'vanillajs-datepicker' {
  const Datepicker: {
    new (element: Element | string, options?: Record<string, unknown>): {
      destroy?: () => void;
    };
  };

  export { Datepicker };
  export default Datepicker;
}
